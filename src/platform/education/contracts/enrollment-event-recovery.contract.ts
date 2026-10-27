/** Education-owned capture/replay. The trusted caller must recheck current
 * actor/action/tenant/branch authority before each call. Keys are not credentials.
 * No outcome here certifies delivery or downstream business processing. */
export interface EnrollmentEventContext {
  readonly tenantId: string;
  readonly requestId: string;
  readonly enrollmentId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
}

export interface EnrollmentCreatedEventSnapshot {
  readonly eventId: string;
  readonly eventType: 'edu.enrollment.created.v1';
  readonly eventVersion: 'v1';
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly aggregateType: 'enrollment';
  readonly requestId: string;
  readonly occurredAt: string;
  readonly payload: {
    readonly enrollmentId: string;
    readonly studentPartyId: string;
    readonly courseId: string;
    /** Initial persisted INSERT state, not a later lifecycle state. */
    readonly status: string;
  };
}

export interface EnrollmentEventRecoveryReceipt {
  readonly event: EnrollmentCreatedEventSnapshot;
  readonly replayState: 'pending' | 'leased' | 'retryable' | 'intervention_required';
  readonly attempts: number;
  readonly lastErrorCode: string | null;
  readonly downstreamProcessing: 'NOT_PROVEN';
  readonly replay: {
    readonly replayKey: string;
    readonly leaseToken: string;
    readonly leaseUntil: string;
    readonly attemptNumber: number;
    readonly outcome: 'leased' | 'released' | 'failed';
    readonly errorCode: string | null;
  } | null;
}

export interface IEducationEnrollmentEventRecoveryContract {
  /** Returns null only if no event was captured for this tenant/request.
   * Older enrollments are never backfilled or recreated by recovery. */
  getCapturedEvent(input: EnrollmentEventContext): Promise<EnrollmentEventRecoveryReceipt | null>;
  /** Stable replayKey recovers the original attempt. A receipt for a completed
   * attempt is not permission to execute again. intervention_required has no lease. */
  claimReplay(input: EnrollmentEventContext & { readonly replayKey: string }): Promise<EnrollmentEventRecoveryReceipt>;
  /** released = lease released, not delivered. failed requires a sanitized code. */
  finishReplay(input: EnrollmentEventContext & {
    readonly replayKey: string;
    readonly leaseToken: string;
    readonly outcome: 'released' | 'failed';
    readonly errorCode?: string;
  }): Promise<EnrollmentEventRecoveryReceipt>;
}

export class EducationEnrollmentEventConflictError extends Error {
  readonly code = 'EDUCATION_EVENT_CANONICAL_CONFLICT';
  constructor() {
    super('Enrollment event context or replay receipt conflicts with the persisted record');
    this.name = 'EducationEnrollmentEventConflictError';
  }
}
