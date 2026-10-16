export class MobilityError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MobilityError';
  }
}

export class MobilityAuthorizationError extends MobilityError {
  constructor(message = 'Mobility actor is not authorized for this operation') {
    super(message, 'MOBILITY_AUTHORIZATION_DENIED');
  }
}

export class MobilityValidationError extends MobilityError {
  constructor(message: string) {
    super(message, 'MOBILITY_VALIDATION_FAILED');
  }
}

export class MobilityNotFoundError extends MobilityError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'MOBILITY_NOT_FOUND');
  }
}

export class MobilityStateError extends MobilityError {
  constructor(message: string) {
    super(message, 'MOBILITY_INVALID_STATE_TRANSITION');
  }
}

export class MobilityIdempotencyConflictError extends MobilityError {
  constructor() {
    super(
      'Idempotency key was already used with a different payload',
      'MOBILITY_IDEMPOTENCY_CONFLICT'
    );
  }
}
