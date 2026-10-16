import { createHash } from 'crypto';
import {
  TourismCapacityError,
  TourismIdempotencyConflictError,
  TourismNotFoundError,
  TourismStateError,
  TourismValidationError,
} from './domain/errors';
import type {
  Booking,
  CancelBookingCommand,
  ConfirmBookingCommand,
  CreateBookingCommand,
  CreateTourCommand,
  CreateTourPackageCommand,
  Departure,
  DepartureAvailability,
  ItineraryDay,
  ItinerarySegment,
  OpenDepartureCommand,
  Participant,
  TourismActor,
  TourismAuditEvent,
  TourismCommandRecord,
  TourismId,
  Tour,
  TourPackage,
  AddItineraryDayCommand,
  AddItinerarySegmentCommand,
} from './domain/types';
import type { TourismAuthorizationPort, TourismClock, TourismIdFactory, TourismRepository } from './ports';

interface TourismServiceOptions {
  readonly repository: TourismRepository;
  readonly authorization: TourismAuthorizationPort;
  readonly clock: TourismClock;
  readonly idFactory: TourismIdFactory;
}

export class TourismFoundationService {
  constructor(private readonly options: TourismServiceOptions) {}

  async createTour(actor: TourismActor, command: CreateTourCommand): Promise<Tour> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:tour:write');
    this.requireText(command.tourCode, 'tourCode');
    this.requireText(command.name, 'name');

    return this.runIdempotent(actor, 'createTour', command.idempotencyKey, command, async (repository) => {
      const now = this.options.clock.now();
      const tour: Tour = {
        id: this.options.idFactory.nextId('tour'),
        tenantId: actor.tenantId,
        tourCode: command.tourCode,
        name: command.name,
        description: command.description,
        status: 'active',
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveTour(tour);
      await this.audit(repository, actor, 'tour', tour.id, 'TOUR_CREATED', { tourCode: tour.tourCode });
      return tour;
    });
  }

  async createTourPackage(actor: TourismActor, command: CreateTourPackageCommand): Promise<TourPackage> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:tour:write');
    this.requireText(command.packageCode, 'packageCode');
    this.requireText(command.name, 'name');

    return this.runIdempotent(actor, 'createTourPackage', command.idempotencyKey, command, async (repository) => {
      await this.requireTour(repository, actor, command.tourId);
      const now = this.options.clock.now();
      const tourPackage: TourPackage = {
        id: this.options.idFactory.nextId('pkg'),
        tenantId: actor.tenantId,
        tourId: command.tourId,
        packageCode: command.packageCode,
        name: command.name,
        description: command.description,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveTourPackage(tourPackage);
      await this.audit(repository, actor, 'tour_package', tourPackage.id, 'TOUR_PACKAGE_CREATED', {
        tourId: command.tourId,
      });
      return tourPackage;
    });
  }

  async addItineraryDay(actor: TourismActor, command: AddItineraryDayCommand): Promise<ItineraryDay> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:itinerary:write');
    if (command.dayNumber < 1) {
      throw new TourismValidationError('dayNumber must be at least 1');
    }
    this.requireText(command.title, 'title');

    return this.runIdempotent(actor, 'addItineraryDay', command.idempotencyKey, command, async (repository) => {
      await this.requireTour(repository, actor, command.tourId);
      await this.requirePackage(repository, actor, command.packageId);
      const now = this.options.clock.now();
      const day: ItineraryDay = {
        id: this.options.idFactory.nextId('itday'),
        tenantId: actor.tenantId,
        tourId: command.tourId,
        packageId: command.packageId,
        dayNumber: command.dayNumber,
        title: command.title,
        notes: command.notes,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveItineraryDay(day);
      await this.audit(repository, actor, 'itinerary_day', day.id, 'ITINERARY_DAY_ADDED', {
        tourId: command.tourId,
        packageId: command.packageId,
      });
      return day;
    });
  }

  async addItinerarySegment(actor: TourismActor, command: AddItinerarySegmentCommand): Promise<ItinerarySegment> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:itinerary:write');
    if (command.sequence < 1) {
      throw new TourismValidationError('sequence must be at least 1');
    }
    this.requireText(command.title, 'title');

    return this.runIdempotent(actor, 'addItinerarySegment', command.idempotencyKey, command, async (repository) => {
      await this.requireItineraryDay(repository, actor, command.itineraryDayId);
      const now = this.options.clock.now();
      const segment: ItinerarySegment = {
        id: this.options.idFactory.nextId('itseg'),
        tenantId: actor.tenantId,
        itineraryDayId: command.itineraryDayId,
        sequence: command.sequence,
        title: command.title,
        startLocation: command.startLocation,
        endLocation: command.endLocation,
        startsAt: command.startsAt,
        endsAt: command.endsAt,
        notes: command.notes,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveItinerarySegment(segment);
      await this.audit(repository, actor, 'itinerary_segment', segment.id, 'ITINERARY_SEGMENT_ADDED', {
        itineraryDayId: command.itineraryDayId,
      });
      return segment;
    });
  }

  async openDeparture(actor: TourismActor, command: OpenDepartureCommand): Promise<Departure> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:departure:write');
    this.requireText(command.departureCode, 'departureCode');
    if (command.capacityTotal < 1) {
      throw new TourismValidationError('capacityTotal must be at least 1');
    }

    return this.runIdempotent(actor, 'openDeparture', command.idempotencyKey, command, async (repository) => {
      await this.requireTour(repository, actor, command.tourId);
      await this.requirePackage(repository, actor, command.packageId);
      const now = this.options.clock.now();
      const departure: Departure = {
        id: this.options.idFactory.nextId('dep'),
        tenantId: actor.tenantId,
        tourId: command.tourId,
        packageId: command.packageId,
        departureCode: command.departureCode,
        startsOn: command.startsOn,
        endsOn: command.endsOn,
        capacityTotal: command.capacityTotal,
        capacityReserved: 0,
        capacityConfirmed: 0,
        status: 'open',
        openedBy: actor.userId,
        openedAt: now,
        updatedAt: now,
      };
      await repository.saveDeparture(departure);
      await this.audit(repository, actor, 'departure', departure.id, 'DEPARTURE_OPENED', {
        capacityTotal: departure.capacityTotal,
      });
      return departure;
    });
  }

  async createBooking(actor: TourismActor, command: CreateBookingCommand): Promise<Booking> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:booking:write');
    this.requireText(command.bookingCode, 'bookingCode');
    if (command.participants.length < 1) {
      throw new TourismValidationError('participants must not be empty');
    }

    return this.runIdempotent(actor, 'createBooking', command.idempotencyKey, command, async (repository) => {
      const departure = await this.requireLockedDeparture(repository, actor, command.departureId);
      if (departure.status !== 'open') {
        throw new TourismStateError('departure must be open before booking');
      }
      const seatCount = command.participants.length;
      this.ensureCapacity(departure, seatCount);
      const now = this.options.clock.now();
      const booking: Booking = {
        id: this.options.idFactory.nextId('booking'),
        tenantId: actor.tenantId,
        departureId: command.departureId,
        bookingCode: command.bookingCode,
        status: 'pending',
        bookerPartyId: command.bookerPartyId,
        seatCount,
        idempotencyKey: command.idempotencyKey,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      };
      const participants: Participant[] = command.participants.map((participant) => ({
        id: this.options.idFactory.nextId('participant'),
        tenantId: actor.tenantId,
        bookingId: booking.id,
        partyId: participant.partyId,
        displayName: participant.displayName,
        participantType: participant.participantType,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      }));
      await repository.saveBooking(booking);
      await repository.saveParticipants(participants);
      await repository.saveDeparture({
        ...departure,
        capacityReserved: departure.capacityReserved + seatCount,
        updatedAt: now,
      });
      await this.audit(repository, actor, 'booking', booking.id, 'BOOKING_CREATED', {
        departureId: command.departureId,
        seatCount,
      });
      return booking;
    });
  }

  async confirmBooking(actor: TourismActor, command: ConfirmBookingCommand): Promise<Booking> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:booking:confirm');

    return this.runIdempotent(actor, 'confirmBooking', command.idempotencyKey, command, async (repository) => {
      const booking = await this.requireBooking(repository, actor, command.bookingId);
      if (booking.status !== 'pending') {
        throw new TourismStateError('only pending bookings can be confirmed');
      }
      const departure = await this.requireLockedDeparture(repository, actor, booking.departureId);
      const now = this.options.clock.now();
      const confirmed: Booking = {
        ...booking,
        status: 'confirmed',
        confirmedBy: actor.userId,
        updatedAt: now,
      };
      await repository.saveBooking(confirmed);
      await repository.saveDeparture({
        ...departure,
        capacityReserved: departure.capacityReserved - booking.seatCount,
        capacityConfirmed: departure.capacityConfirmed + booking.seatCount,
        updatedAt: now,
      });
      await this.audit(repository, actor, 'booking', booking.id, 'BOOKING_CONFIRMED', {
        departureId: booking.departureId,
        seatCount: booking.seatCount,
      });
      return confirmed;
    });
  }

  async cancelBooking(actor: TourismActor, command: CancelBookingCommand): Promise<Booking> {
    await this.options.authorization.ensureAllowed(actor, 'tourism:booking:cancel');

    return this.runIdempotent(actor, 'cancelBooking', command.idempotencyKey, command, async (repository) => {
      const booking = await this.requireBooking(repository, actor, command.bookingId);
      if (booking.status === 'cancelled') {
        throw new TourismStateError('booking is already cancelled');
      }
      const departure = await this.requireLockedDeparture(repository, actor, booking.departureId);
      const now = this.options.clock.now();
      const cancelled: Booking = {
        ...booking,
        status: 'cancelled',
        cancelledBy: actor.userId,
        updatedAt: now,
      };
      const reservedRelease = booking.status === 'pending' ? booking.seatCount : 0;
      const confirmedRelease = booking.status === 'confirmed' ? booking.seatCount : 0;
      await repository.saveBooking(cancelled);
      await repository.saveDeparture({
        ...departure,
        capacityReserved: departure.capacityReserved - reservedRelease,
        capacityConfirmed: departure.capacityConfirmed - confirmedRelease,
        updatedAt: now,
      });
      await this.audit(repository, actor, 'booking', booking.id, 'BOOKING_CANCELLED', {
        departureId: booking.departureId,
        reason: command.reason,
      });
      return cancelled;
    });
  }

  async getDepartureAvailability(actor: TourismActor, departureId: TourismId): Promise<DepartureAvailability> {
    const departure = await this.options.repository.lockDeparture(actor.tenantId, departureId);
    if (!departure) {
      throw new TourismNotFoundError(`Departure ${departureId} was not found`);
    }
    return {
      departureId,
      capacityTotal: departure.capacityTotal,
      reservedSeats: departure.capacityReserved,
      confirmedSeats: departure.capacityConfirmed,
      availableSeats: departure.capacityTotal - departure.capacityReserved - departure.capacityConfirmed,
    };
  }

  private async runIdempotent<T extends Record<string, unknown> | { readonly id: TourismId }>(
    actor: TourismActor,
    operation: string,
    businessKey: string,
    payload: unknown,
    work: (repository: TourismRepository) => Promise<T>,
  ): Promise<T> {
    this.requireText(businessKey, 'idempotencyKey');
    const payloadHash = this.hashPayload(payload);
    return this.options.repository.withTransaction(async (repository) => {
      const existing = await repository.findCommandRecord(actor.tenantId, operation, businessKey);
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new TourismIdempotencyConflictError(`${operation} idempotency key was reused with a different payload`);
        }
        return existing.result as T;
      }
      const result = await work(repository);
      const record: TourismCommandRecord = {
        id: this.options.idFactory.nextId('cmd'),
        tenantId: actor.tenantId,
        operation,
        businessKey,
        payloadHash,
        result: this.toPlainRecord(result),
        createdAt: this.options.clock.now(),
      };
      await repository.saveCommandRecord(record);
      return result;
    });
  }

  private async requireTour(repository: TourismRepository, actor: TourismActor, tourId: TourismId): Promise<Tour> {
    const tour = await repository.findTour(actor.tenantId, tourId);
    if (!tour) {
      throw new TourismNotFoundError(`Tour ${tourId} was not found`);
    }
    return tour;
  }

  private async requirePackage(
    repository: TourismRepository,
    actor: TourismActor,
    packageId: TourismId,
  ): Promise<TourPackage> {
    const tourPackage = await repository.findTourPackage(actor.tenantId, packageId);
    if (!tourPackage) {
      throw new TourismNotFoundError(`Tour package ${packageId} was not found`);
    }
    return tourPackage;
  }

  private async requireItineraryDay(
    repository: TourismRepository,
    actor: TourismActor,
    itineraryDayId: TourismId,
  ): Promise<ItineraryDay> {
    const day = await repository.findItineraryDay(actor.tenantId, itineraryDayId);
    if (!day) {
      throw new TourismNotFoundError(`Itinerary day ${itineraryDayId} was not found`);
    }
    return day;
  }

  private async requireLockedDeparture(
    repository: TourismRepository,
    actor: TourismActor,
    departureId: TourismId,
  ): Promise<Departure> {
    const departure = await repository.lockDeparture(actor.tenantId, departureId);
    if (!departure) {
      throw new TourismNotFoundError(`Departure ${departureId} was not found`);
    }
    return departure;
  }

  private async requireBooking(repository: TourismRepository, actor: TourismActor, bookingId: TourismId): Promise<Booking> {
    const booking = await repository.findBooking(actor.tenantId, bookingId);
    if (!booking) {
      throw new TourismNotFoundError(`Booking ${bookingId} was not found`);
    }
    return booking;
  }

  private ensureCapacity(departure: Departure, requestedSeats: number): void {
    const available = departure.capacityTotal - departure.capacityReserved - departure.capacityConfirmed;
    if (available < requestedSeats) {
      throw new TourismCapacityError(`Departure has ${available} seats available, requested ${requestedSeats}`);
    }
  }

  private async audit(
    repository: TourismRepository,
    actor: TourismActor,
    entityType: string,
    entityId: TourismId,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const now = this.options.clock.now();
    const event: TourismAuditEvent = {
      id: this.options.idFactory.nextId('audit'),
      tenantId: actor.tenantId,
      entityType,
      entityId,
      action,
      actorId: actor.userId,
      metadata,
      createdAt: now,
    };
    await repository.appendAuditEvent(event);
  }

  private requireText(value: string, field: string): void {
    if (!value.trim()) {
      throw new TourismValidationError(`${field} must not be empty`);
    }
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(this.normalize(payload))).digest('hex');
  }

  private normalize(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalize(entry));
    }
    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      return Object.keys(source)
        .sort()
        .reduce<Record<string, unknown>>((normalized, key) => {
          normalized[key] = this.normalize(source[key]);
          return normalized;
        }, {});
    }
    return value;
  }

  private toPlainRecord(value: unknown): Record<string, unknown> {
    return this.normalize(value) as Record<string, unknown>;
  }
}
