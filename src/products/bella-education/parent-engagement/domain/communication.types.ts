// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT DOMAIN TYPES
// File: src/products/bella-education/parent-engagement/domain/communication.types.ts
// ============================================================================

export type ThreadType =
  | 'GENERAL'
  | 'CARE_DIGEST'
  | 'HEALTH_INCIDENT'
  | 'PORTFOLIO'
  | 'CONSENT_REQUEST';

export type NoticeCategory =
  | 'INFO'
  | 'CRITICAL'
  | 'CONSENT'
  | 'FEEDBACK_REQ';

export type NoticePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type RequirementType = 'NOTICE_ONLY' | 'REQUIRES_ACK' | 'REQUIRES_CONSENT';

export type DeliveryChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS';

export type DeliveryStatus = 'DRAFT' | 'READY' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type AckStatus = 'NOT_REQUIRED' | 'PENDING' | 'ACKNOWLEDGED' | 'EXPIRED';

export type ConsentDecision =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export type ConsentScope =
  | 'FIELD_TRIP'
  | 'PHOTO_RELEASE'
  | 'MEDICATION_ADMIN'
  | 'MEDICAL_TREATMENT';

export type ExceptionType =
  | 'OVERDUE_ACK'
  | 'OVERDUE_CONSENT'
  | 'DELIVERY_FAILED'
  | 'CONSENT_DECLINED'
  | 'STAFFING_SHORTAGE_SLA'
  | 'SAFETY_DEFECT'
  | 'OVERDUE_INSPECTION';

export type ExceptionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'BYPASSED';

export interface CommunicationThread {
  id: string;
  tenant_id: string;
  student_id: string;
  guardian_party_id: string;
  thread_type: ThreadType;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED';
  last_activity_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CommunicationNotice {
  id: string;
  tenant_id: string;
  thread_id: string;
  source_domain: string; // P3_CLASSROOM, P4_CARE, P5_LEARNING, SCHOOL_ADMIN
  source_entity_type: string;
  source_entity_id: string;
  source_version?: string;
  projection_type?: string;
  publication_snapshot_ref?: string;
  notice_category: NoticeCategory;
  priority: NoticePriority;
  requirement_type: RequirementType;
  title: string;
  body_text: string;
  metadata?: Record<string, unknown>;
  due_at?: string;
  is_archived: boolean;
  created_by: string;
  created_at: string;
}

export interface CommunicationDelivery {
  id: string;
  tenant_id: string;
  notice_id: string;
  recipient_party_id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAttempt {
  id: string;
  tenant_id: string;
  delivery_id: string;
  notice_id: string;
  attempt_number: number;
  channel: DeliveryChannel;
  status: 'SUCCESS' | 'FAILED';
  error_code?: string;
  error_details?: string;
  attempted_at: string;
}

export interface CommunicationAcknowledgement {
  id: string;
  tenant_id: string;
  notice_id: string;
  guardian_party_id: string;
  acknowledgement_type: string;
  status: 'ACKNOWLEDGED' | 'EXPIRED';
  acknowledged_at: string;
  signature_note?: string;
  ip_hash?: string;
  created_at: string;
}

export interface ConsentResponse {
  id: string;
  tenant_id: string;
  notice_id: string;
  guardian_party_id: string;
  consent_scope: ConsentScope;
  decision: ConsentDecision;
  decision_at?: string;
  valid_from?: string;
  valid_until?: string;
  conditions?: string;
  revoked_at?: string;
  revoked_by?: string;
  revocation_reason?: string;
  created_at: string;
}

export interface CommunicationResponse {
  id: string;
  tenant_id: string;
  thread_id: string;
  notice_id?: string;
  sender_party_id: string;
  sender_role: 'PARENT' | 'TEACHER' | 'SCHOOL_STAFF';
  response_text: string;
  attachments?: Array<{ name: string; url: string; mime_type: string }>;
  created_at: string;
}

export interface CommunicationException {
  id: string;
  tenant_id: string;
  notice_id?: string | null;
  student_id: string;
  guardian_party_id: string | null;
  exception_type: ExceptionType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigned_role: 'TEACHER' | 'NURSE' | 'PRINCIPAL' | 'ADMIN' | 'FACILITY_MANAGER' | 'SAFETY_OFFICER';
  status: ExceptionStatus;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SentSnapshot {
  id: string;
  tenant_id: string;
  notice_id: string;
  recipient_party_id: string;
  delivery_id: string;
  channel: DeliveryChannel;
  payload_snapshot: Record<string, unknown>;
  payload_hash: string;
  dispatched_at: string;
}

// Error Messages / Standard Invariants
export const P6_ERROR_CODES = {
  UNAUTHORIZED_GUARDIAN_RELATIONSHIP: 'UNAUTHORIZED_GUARDIAN_RELATIONSHIP_ERROR',
  INVALID_DELIVERY_STATE_TRANSITION: 'INVALID_DELIVERY_STATE_TRANSITION_ERROR',
  SENT_SNAPSHOT_IMMUTABLE: 'SENT_SNAPSHOT_IMMUTABLE_ERROR',
  ACKNOWLEDGED_BEFORE_READ: 'ACKNOWLEDGED_BEFORE_READ_ERROR',
  CONSENT_BEFORE_READ: 'CONSENT_BEFORE_READ_ERROR',
  MEDICATION_CONSENT_P4_REQUIRED: 'MEDICATION_CONSENT_P4_REQUIRED_ERROR',
  TENANT_MISMATCH: 'COMMUNICATION_TENANT_MISMATCH_ERROR',
  PORTFOLIO_NOT_PUBLISHED: 'PORTFOLIO_NOT_PUBLISHED_ERROR',
} as const;
