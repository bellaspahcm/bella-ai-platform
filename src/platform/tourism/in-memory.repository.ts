import { TourismAuthorizationError } from './domain/errors';
import type {
  Booking,
  Departure,
  ItineraryDay,
  ItinerarySegment,
  Participant,
  Tour,
  TourPackage,
  TourismActor,
  TourismAuditEvent,
  TourismCommandRecord,
  TourismId,
  TourismTenantId,
} from './domain/types';
import type { TourismAuthorizationPort, TourismClock, TourismIdFactory, TourismPermission, TourismRepository } from './ports';

export class InMemoryTourismRepository implements TourismRepository {
  private readonly commands = new Map<string, TourismCommandRecord>();
  private readonly tours = new Map<string, Tour>();
  private readonly packages = new Map<string, TourPackage>();
  private readonly days = new Map<string, ItineraryDay>();
  private readonly segments = new Map<string, ItinerarySegment>();
  private readonly departures = new Map<string, Departure>();
  private readonly bookings = new Map<string, Booking>();
  private readonly participants = new Map<string, Participant>();
  private readonly auditEvents: TourismAuditEvent[] = [];

  async withTransaction<T>(work: (repository: TourismRepository) => Promise<T>): Promise<T> {
    return work(this);
  }

  async findCommandRecord(
    tenantId: TourismTenantId,
    operation: string,
    businessKey: string,
  ): Promise<TourismCommandRecord | null> {
    return this.commands.get(this.key(tenantId, operation, businessKey)) ?? null;
  }

  async saveCommandRecord(record: TourismCommandRecord): Promise<void> {
    this.commands.set(this.key(record.tenantId, record.operation, record.businessKey), record);
  }

  async findTour(tenantId: TourismTenantId, tourId: TourismId): Promise<Tour | null> {
    return this.findByTenant(this.tours, tenantId, tourId);
  }

  async saveTour(tour: Tour): Promise<void> {
    this.tours.set(tour.id, tour);
  }

  async findTourPackage(tenantId: TourismTenantId, packageId: TourismId): Promise<TourPackage | null> {
    return this.findByTenant(this.packages, tenantId, packageId);
  }

  async saveTourPackage(tourPackage: TourPackage): Promise<void> {
    this.packages.set(tourPackage.id, tourPackage);
  }

  async findItineraryDay(tenantId: TourismTenantId, itineraryDayId: TourismId): Promise<ItineraryDay | null> {
    return this.findByTenant(this.days, tenantId, itineraryDayId);
  }

  async saveItineraryDay(day: ItineraryDay): Promise<void> {
    this.days.set(day.id, day);
  }

  async saveItinerarySegment(segment: ItinerarySegment): Promise<void> {
    this.segments.set(segment.id, segment);
  }

  async lockDeparture(tenantId: TourismTenantId, departureId: TourismId): Promise<Departure | null> {
    return this.findByTenant(this.departures, tenantId, departureId);
  }

  async saveDeparture(departure: Departure): Promise<void> {
    this.departures.set(departure.id, departure);
  }

  async findBooking(tenantId: TourismTenantId, bookingId: TourismId): Promise<Booking | null> {
    return this.findByTenant(this.bookings, tenantId, bookingId);
  }

  async saveBooking(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, booking);
  }

  async saveParticipants(participants: readonly Participant[]): Promise<void> {
    for (const participant of participants) {
      this.participants.set(participant.id, participant);
    }
  }

  async appendAuditEvent(event: TourismAuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }

  async listAuditEvents(tenantId: TourismTenantId): Promise<readonly TourismAuditEvent[]> {
    return this.auditEvents.filter((event) => event.tenantId === tenantId);
  }

  private findByTenant<T extends { readonly id: TourismId; readonly tenantId: TourismTenantId }>(
    source: ReadonlyMap<string, T>,
    tenantId: TourismTenantId,
    id: TourismId,
  ): T | null {
    const value = source.get(id);
    if (!value || value.tenantId !== tenantId) {
      return null;
    }
    return value;
  }

  private key(...parts: readonly string[]): string {
    return parts.join('::');
  }
}

export class StaticTourismAuthorization implements TourismAuthorizationPort {
  constructor(private readonly allowed: ReadonlySet<TourismPermission> = new Set<TourismPermission>()) {}

  async ensureAllowed(actor: TourismActor, permission: TourismPermission): Promise<void> {
    if (!this.allowed.has(permission)) {
      throw new TourismAuthorizationError(`Actor ${actor.userId} is not allowed to ${permission}`);
    }
  }
}

export class FixedTourismClock implements TourismClock {
  constructor(private readonly fixedNow: Date = new Date('2026-10-12T00:00:00.000Z')) {}

  now(): Date {
    return new Date(this.fixedNow);
  }
}

export class SequentialTourismIdFactory implements TourismIdFactory {
  private counter = 0;

  nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }
}
