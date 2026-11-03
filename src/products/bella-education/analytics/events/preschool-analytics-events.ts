/**
 * Bella Preschool OS — Preschool Analytics Domain Events (P10.1)
 * File: src/products/bella-education/analytics/events/preschool-analytics-events.ts
 *
 * Defines Domain Event contracts emitted by P1–P9 domains when operational truth changes.
 * Canonical Law: Domain owns truth ➔ Event announces truth changed ➔ Analytics projects truth ➔ Dashboard displays it.
 */

export type PreschoolDomainEventType = 
  | 'STUDENT_ENROLLED'
  | 'STUDENT_WITHDRAWN'
  | 'ATTENDANCE_RECORDED'
  | 'HEALTH_INCIDENT_REPORTED'
  | 'MEDICATION_ADMINISTERED'
  | 'PORTFOLIO_PUBLISHED'
  | 'NOTICE_DISPATCHED'
  | 'DELIVERY_ACKNOWLEDGED'
  | 'CONSENT_RESPONDED'
  | 'INVOICE_ISSUED'
  | 'PAYMENT_RECONCILED'
  | 'SHIFT_RATIO_EVALUATED'
  | 'LEAVE_SUBSTITUTE_ALLOCATED'
  | 'SAFETY_DEFECT_REPORTED'
  | 'SAFETY_INSPECTION_PASSED';

export interface PreschoolDomainEvent<T = unknown> {
  eventId: string;
  tenantId: string;
  eventType: PreschoolDomainEventType;
  sourceDomain: string; // e.g. 'P1_STUDENT', 'P3_ATTENDANCE', 'P7_FINANCE', 'P8_WORKFORCE', 'P9_FACILITIES'
  entityId: string;
  payload: T;
  timestamp: string;
}
