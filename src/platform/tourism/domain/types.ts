export type TourismId = string;
export type TourismTenantId = string;
export type TourismUserId = string;

export interface TourismActor {
  readonly tenantId: TourismTenantId;
  readonly userId: TourismUserId;
  readonly roles: readonly string[];
}

export type TourStatus = 'draft' | 'active' | 'archived';
export type DepartureStatus = 'open' | 'closed' | 'cancelled' | 'completed';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Tour {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly tourCode: string;
  readonly name: string;
  readonly description?: string;
  readonly status: TourStatus;
  readonly createdBy: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TourPackage {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly tourId: TourismId;
  readonly packageCode: string;
  readonly name: string;
  readonly description?: string;
  readonly createdBy: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ItineraryDay {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly tourId: TourismId;
  readonly packageId: TourismId;
  readonly dayNumber: number;
  readonly title: string;
  readonly notes?: string;
  readonly createdBy: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ItinerarySegment {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly itineraryDayId: TourismId;
  readonly sequence: number;
  readonly title: string;
  readonly startLocation?: string;
  readonly endLocation?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly notes?: string;
  readonly createdBy: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Departure {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly tourId: TourismId;
  readonly packageId: TourismId;
  readonly departureCode: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly capacityTotal: number;
  readonly capacityReserved: number;
  readonly capacityConfirmed: number;
  readonly status: DepartureStatus;
  readonly openedBy: TourismUserId;
  readonly openedAt: Date;
  readonly updatedAt: Date;
}

export interface Booking {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly departureId: TourismId;
  readonly bookingCode: string;
  readonly status: BookingStatus;
  readonly bookerPartyId: TourismId;
  readonly seatCount: number;
  readonly idempotencyKey: string;
  readonly createdBy: TourismUserId;
  readonly confirmedBy?: TourismUserId;
  readonly cancelledBy?: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Participant {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly bookingId: TourismId;
  readonly partyId: TourismId;
  readonly displayName: string;
  readonly participantType: 'adult' | 'child' | 'infant';
  readonly createdBy: TourismUserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TourismAuditEvent {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly entityType: string;
  readonly entityId: TourismId;
  readonly action: string;
  readonly actorId: TourismUserId;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface TourismCommandRecord {
  readonly id: TourismId;
  readonly tenantId: TourismTenantId;
  readonly operation: string;
  readonly businessKey: string;
  readonly payloadHash: string;
  readonly result: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface ParticipantInput {
  readonly partyId: TourismId;
  readonly displayName: string;
  readonly participantType: 'adult' | 'child' | 'infant';
}

export interface CreateTourCommand {
  readonly tourCode: string;
  readonly name: string;
  readonly description?: string;
  readonly idempotencyKey: string;
}

export interface CreateTourPackageCommand {
  readonly tourId: TourismId;
  readonly packageCode: string;
  readonly name: string;
  readonly description?: string;
  readonly idempotencyKey: string;
}

export interface AddItineraryDayCommand {
  readonly tourId: TourismId;
  readonly packageId: TourismId;
  readonly dayNumber: number;
  readonly title: string;
  readonly notes?: string;
  readonly idempotencyKey: string;
}

export interface AddItinerarySegmentCommand {
  readonly itineraryDayId: TourismId;
  readonly sequence: number;
  readonly title: string;
  readonly startLocation?: string;
  readonly endLocation?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly notes?: string;
  readonly idempotencyKey: string;
}

export interface OpenDepartureCommand {
  readonly tourId: TourismId;
  readonly packageId: TourismId;
  readonly departureCode: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly capacityTotal: number;
  readonly idempotencyKey: string;
}

export interface CreateBookingCommand {
  readonly departureId: TourismId;
  readonly bookingCode: string;
  readonly bookerPartyId: TourismId;
  readonly participants: readonly ParticipantInput[];
  readonly idempotencyKey: string;
}

export interface ConfirmBookingCommand {
  readonly bookingId: TourismId;
  readonly idempotencyKey: string;
}

export interface CancelBookingCommand {
  readonly bookingId: TourismId;
  readonly reason?: string;
  readonly idempotencyKey: string;
}

export interface DepartureAvailability {
  readonly departureId: TourismId;
  readonly capacityTotal: number;
  readonly reservedSeats: number;
  readonly confirmedSeats: number;
  readonly availableSeats: number;
}
