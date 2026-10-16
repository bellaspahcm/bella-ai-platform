export class TourismError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class TourismAuthorizationError extends TourismError {}

export class TourismValidationError extends TourismError {}

export class TourismNotFoundError extends TourismError {}

export class TourismStateError extends TourismError {}

export class TourismCapacityError extends TourismError {}

export class TourismIdempotencyConflictError extends TourismError {}
