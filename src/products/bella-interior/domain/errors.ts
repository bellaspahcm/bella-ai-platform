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

