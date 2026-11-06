export class ConstructionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ConstructionError';
  }
}

export class ConstructionAuthorizationError extends ConstructionError {
  constructor(message = 'Construction actor is not authorized for this operation') {
    super(message, 'CONSTRUCTION_AUTHORIZATION_DENIED');
  }
}

export class ConstructionAuthorizationUnavailableError extends ConstructionError {
  constructor(reason: string) {
    super(`Construction authorization is unavailable: ${reason}`, 'CONSTRUCTION_AUTHORIZATION_UNAVAILABLE');
  }
}

export class ConstructionValidationError extends ConstructionError {
  constructor(message: string) {
    super(message, 'CONSTRUCTION_VALIDATION_FAILED');
  }
}

export class ConstructionNotFoundError extends ConstructionError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'CONSTRUCTION_NOT_FOUND');
  }
}

export class ConstructionStateError extends ConstructionError {
  constructor(message: string) {
    super(message, 'CONSTRUCTION_INVALID_STATE');
  }
}
