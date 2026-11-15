/**
 * Bella Interior OS — Domain Errors
 *
 * Specific domain errors enforcing core invariants of the Interior OS.
 * @module src/products/bella-interior/domain/errors
 */

export class TenantIsolationViolationError extends Error {
  constructor(message = 'Tenant isolation violation: tenantId is required and must match request context') {
    super(message);
    this.name = 'TenantIsolationViolationError';
  }
}

export class ApprovedDesignLockViolationError extends Error {
  constructor(revisionNumber: number, currentStatus: string) {
    super(
      `Cannot issue production order or lock contract baseline from Design Revision #${revisionNumber}. Current status is '${currentStatus}', but 'approved' is strictly required.`
    );
    this.name = 'ApprovedDesignLockViolationError';
  }
}

export class InvalidDesignRevisionStatusError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid design revision transition from '${from}' to '${to}'.`);
    this.name = 'InvalidDesignRevisionStatusError';
  }
}

export class MilestonePercentageSumError extends Error {
  constructor(totalPercentage: number) {
    super(
      `Contract payment milestone percentages must sum exactly to 100%. Received: ${totalPercentage}%.`
    );
    this.name = 'MilestonePercentageSumError';
  }
}

export class OpenCriticalPunchListError extends Error {
  constructor(openCriticalCount: number) {
    super(
      `Cannot complete project handover while ${openCriticalCount} critical/major punch list defect(s) remain open.`
    );
    this.name = 'OpenCriticalPunchListError';
  }
}

export class HandoverCustomerApprovalRequiredError extends Error {
  constructor() {
    super('Cannot complete project handover without a persisted, customer-issued acceptance record.');
    this.name = 'HandoverCustomerApprovalRequiredError';
  }
}

export class BOQItemNotFoundError extends Error {
  constructor(boqItemId: string) {
    super(`BOQ Item not found: ${boqItemId}`);
    this.name = 'BOQItemNotFoundError';
  }
}

export class InteriorAuthorizationError extends Error {
  constructor(reason: string) {
    super(`Interior operation authorization denied: ${reason}`);
    this.name = 'InteriorAuthorizationError';
  }
}

export class TakeoffRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Takeoff Run not found: ${runId}`);
    this.name = 'TakeoffRunNotFoundError';
  }
}

export class TakeoffRunImmutableError extends Error {
  constructor(runId: string, status: string) {
    super(
      `Takeoff Run '${runId}' is immutable in status '${status}'. Completed or locked runs cannot be modified.`
    );
    this.name = 'TakeoffRunImmutableError';
  }
}

export class TakeoffComponentNotFoundError extends Error {
  constructor(componentId: string) {
    super(`Takeoff Component not found: ${componentId}`);
    this.name = 'TakeoffComponentNotFoundError';
  }
}

export class InvalidRoomZoneBindingError extends Error {
  constructor(zoneId: string, projectId: string) {
    super(
      `Room Zone '${zoneId}' does not belong to project '${projectId}' or does not exist.`
    );
    this.name = 'InvalidRoomZoneBindingError';
  }
}

export class TakeoffIncompleteReviewError extends Error {
  constructor(pendingCount: number) {
    super(
      `Cannot complete Takeoff Run with ${pendingCount} component(s) still pending review. All components must be reviewed by Estimator.`
    );
    this.name = 'TakeoffIncompleteReviewError';
  }
}

export class TakeoffDiffRunMismatchError extends Error {
  constructor(reason: string) {
    super(`Takeoff Diff computation failed: ${reason}`);
    this.name = 'TakeoffDiffRunMismatchError';
  }
}

export class BOQUnderReviewSyncForbiddenError extends Error {
  constructor(boqId: string, versionNumber: number) {
    super(
      `Cannot sync design diff to BOQ '${boqId}' (R${versionNumber}.0) in status 'under_review'. The BOQ is currently awaiting approval. Estimator must reject or approve the current revision before initiating a new sync.`
    );
    this.name = 'BOQUnderReviewSyncForbiddenError';
  }
}

export class BOQProjectMismatchError extends Error {
  constructor(diffProjectId: string, boqProjectId: string) {
    super(
      `Project mismatch in BOQ sync: Diff project '${diffProjectId}' does not match target BOQ project '${boqProjectId}'.`
    );
    this.name = 'BOQProjectMismatchError';
  }
}

export class BOQConcurrencyConflictError extends Error {
  constructor(boqId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict on BOQ '${boqId}': expected version ${expectedVersion}, but found version ${actualVersion}. Another estimator or operation has modified this BOQ.`
    );
    this.name = 'BOQConcurrencyConflictError';
  }
}

export class BOQUnresolvedItemsExistError extends Error {
  constructor(unresolvedCount: number) {
    super(
      `Cannot submit or approve BOQ while ${unresolvedCount} unresolved review items (REVIEW_REQUIRED) remain pending. Estimator must resolve all component ambiguities before submission.`
    );
    this.name = 'BOQUnresolvedItemsExistError';
  }
}


