export class AgricultureError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AgricultureError';
  }
}

export class AgricultureAuthorizationError extends AgricultureError {
  constructor(message = 'Agriculture actor is not authorized for this operation') {
    super(message, 'AGRICULTURE_AUTHORIZATION_DENIED');
  }
}

export class AgricultureValidationError extends AgricultureError {
  constructor(message: string) {
    super(message, 'AGRICULTURE_VALIDATION_FAILED');
  }
}

export class AgricultureNotFoundError extends AgricultureError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'AGRICULTURE_NOT_FOUND');
  }
}

export class AgricultureStateError extends AgricultureError {
  constructor(message: string) {
    super(message, 'AGRICULTURE_INVALID_STATE_TRANSITION');
  }
}

export class AgricultureIdempotencyConflictError extends AgricultureError {
  constructor() {
    super(
      'Idempotency key was already used with a different payload',
      'AGRICULTURE_IDEMPOTENCY_CONFLICT'
    );
  }
}
