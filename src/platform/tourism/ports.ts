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

export type TourismPermission =
  | 'tourism:tour:write'
  | 'tourism:itinerary:write'
  | 'tourism:departure:write'
  | 'tourism:booking:write'
  | 'tourism:booking:confirm'
  | 'tourism:booking:cancel';

export interface TourismAuthorizationPort {
  ensureAllowed(actor: TourismActor, permission: TourismPermission): Promise<void>;
}

export interface TourismClock {
  now(): Date;
}

export interface TourismIdFactory {
  nextId(prefix: string): string;
}

export interface TourismRepository {
  withTransaction<T>(work: (repository: TourismRepository) => Promise<T>): Promise<T>;

  findCommandRecord(
    tenantId: TourismTenantId,
    operation: string,
    businessKey: string,
  ): Promise<TourismCommandRecord | null>;
  saveCommandRecord(record: TourismCommandRecord): Promise<void>;

  findTour(tenantId: TourismTenantId, tourId: TourismId): Promise<Tour | null>;
  saveTour(tour: Tour): Promise<void>;

  findTourPackage(tenantId: TourismTenantId, packageId: TourismId): Promise<TourPackage | null>;
  saveTourPackage(tourPackage: TourPackage): Promise<void>;

  findItineraryDay(tenantId: TourismTenantId, itineraryDayId: TourismId): Promise<ItineraryDay | null>;
  saveItineraryDay(day: ItineraryDay): Promise<void>;
  saveItinerarySegment(segment: ItinerarySegment): Promise<void>;

  lockDeparture(tenantId: TourismTenantId, departureId: TourismId): Promise<Departure | null>;
  saveDeparture(departure: Departure): Promise<void>;

  findBooking(tenantId: TourismTenantId, bookingId: TourismId): Promise<Booking | null>;
  saveBooking(booking: Booking): Promise<void>;
  saveParticipants(participants: readonly Participant[]): Promise<void>;

  appendAuditEvent(event: TourismAuditEvent): Promise<void>;
  listAuditEvents(tenantId: TourismTenantId): Promise<readonly TourismAuditEvent[]>;
}
