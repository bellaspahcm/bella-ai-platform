import {
  FixedTourismClock,
  InMemoryTourismRepository,
  SequentialTourismIdFactory,
  StaticTourismAuthorization,
} from '../in-memory.repository';
import { TourismFoundationService } from '../tourism-foundation.service';
import { TourismAuthorizationError, TourismCapacityError, TourismIdempotencyConflictError, TourismStateError } from '../domain/errors';
import type { TourismActor } from '../domain/types';
import type { TourismPermission } from '../ports';

const allPermissions: ReadonlySet<TourismPermission> = new Set<TourismPermission>([
  'tourism:tour:write',
  'tourism:itinerary:write',
  'tourism:departure:write',
  'tourism:booking:write',
  'tourism:booking:confirm',
  'tourism:booking:cancel',
]);

function createService(permissions: ReadonlySet<TourismPermission> = allPermissions) {
  const repository = new InMemoryTourismRepository();
  const service = new TourismFoundationService({
    repository,
    authorization: new StaticTourismAuthorization(permissions),
    clock: new FixedTourismClock(),
    idFactory: new SequentialTourismIdFactory(),
  });
  return { repository, service };
}

const actor: TourismActor = {
  tenantId: 'tenant-tourism',
  userId: 'user-tourism',
  roles: ['tourism_operator'],
};

async function createOpenDeparture(service: TourismFoundationService, capacityTotal = 4) {
  const tour = await service.createTour(actor, {
    tourCode: 'DN-HOI-AN',
    name: 'Da Nang Hoi An',
    idempotencyKey: 'tour-1',
  });
  const tourPackage = await service.createTourPackage(actor, {
    tourId: tour.id,
    packageCode: 'STD',
    name: 'Standard',
    idempotencyKey: 'pkg-1',
  });
  const day = await service.addItineraryDay(actor, {
    tourId: tour.id,
    packageId: tourPackage.id,
    dayNumber: 1,
    title: 'Arrival',
    idempotencyKey: 'day-1',
  });
  await service.addItinerarySegment(actor, {
    itineraryDayId: day.id,
    sequence: 1,
    title: 'Airport pickup',
    startLocation: 'Da Nang Airport',
    endLocation: 'Hoi An',
    idempotencyKey: 'segment-1',
  });
  const departure = await service.openDeparture(actor, {
    tourId: tour.id,
    packageId: tourPackage.id,
    departureCode: 'DNHA-2026-11-01',
    startsOn: '2026-11-01',
    endsOn: '2026-11-03',
    capacityTotal,
    idempotencyKey: 'departure-1',
  });
  return { departure, tour, tourPackage };
}

describe('TourismFoundationService', () => {
  it('supports the approved OS flow from tour creation to confirmed booking', async () => {
    const { repository, service } = createService();
    const { departure } = await createOpenDeparture(service);

    const booking = await service.createBooking(actor, {
      departureId: departure.id,
      bookingCode: 'BKG-001',
      bookerPartyId: 'party-booker',
      participants: [
        { partyId: 'party-booker', displayName: 'Booker', participantType: 'adult' },
        { partyId: 'party-guest', displayName: 'Guest', participantType: 'adult' },
      ],
      idempotencyKey: 'booking-1',
    });

    const pendingAvailability = await service.getDepartureAvailability(actor, departure.id);
    expect(booking.status).toBe('pending');
    expect(pendingAvailability.reservedSeats).toBe(2);
    expect(pendingAvailability.availableSeats).toBe(2);

    const confirmed = await service.confirmBooking(actor, {
      bookingId: booking.id,
      idempotencyKey: 'confirm-1',
    });
    const confirmedAvailability = await service.getDepartureAvailability(actor, departure.id);
    const auditEvents = await repository.listAuditEvents(actor.tenantId);

    expect(confirmed.status).toBe('confirmed');
    expect(confirmedAvailability.reservedSeats).toBe(0);
    expect(confirmedAvailability.confirmedSeats).toBe(2);
    expect(auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'TOUR_CREATED',
        'TOUR_PACKAGE_CREATED',
        'ITINERARY_DAY_ADDED',
        'ITINERARY_SEGMENT_ADDED',
        'DEPARTURE_OPENED',
        'BOOKING_CREATED',
        'BOOKING_CONFIRMED',
      ]),
    );
  });

  it('rejects over-capacity bookings before seats are reserved', async () => {
    const { service } = createService();
    const { departure } = await createOpenDeparture(service, 1);

    await expect(
      service.createBooking(actor, {
        departureId: departure.id,
        bookingCode: 'BKG-OVER',
        bookerPartyId: 'party-booker',
        participants: [
          { partyId: 'party-booker', displayName: 'Booker', participantType: 'adult' },
          { partyId: 'party-guest', displayName: 'Guest', participantType: 'adult' },
        ],
        idempotencyKey: 'booking-over',
      }),
    ).rejects.toBeInstanceOf(TourismCapacityError);

    const availability = await service.getDepartureAvailability(actor, departure.id);
    expect(availability.availableSeats).toBe(1);
    expect(availability.reservedSeats).toBe(0);
  });

  it('returns the original result for an idempotent retry and rejects conflicting reuse', async () => {
    const { service } = createService();

    const first = await service.createTour(actor, {
      tourCode: 'IDEMP',
      name: 'Idempotent tour',
      idempotencyKey: 'same-key',
    });
    const retry = await service.createTour(actor, {
      tourCode: 'IDEMP',
      name: 'Idempotent tour',
      idempotencyKey: 'same-key',
    });

    expect(retry.id).toBe(first.id);
    await expect(
      service.createTour(actor, {
        tourCode: 'IDEMP-CHANGED',
        name: 'Changed tour',
        idempotencyKey: 'same-key',
      }),
    ).rejects.toBeInstanceOf(TourismIdempotencyConflictError);
  });

  it('releases reserved seats when a pending booking is cancelled', async () => {
    const { service } = createService();
    const { departure } = await createOpenDeparture(service, 2);
    const booking = await service.createBooking(actor, {
      departureId: departure.id,
      bookingCode: 'BKG-CANCEL-PENDING',
      bookerPartyId: 'party-booker',
      participants: [{ partyId: 'party-booker', displayName: 'Booker', participantType: 'adult' }],
      idempotencyKey: 'booking-cancel-pending',
    });

    const cancelled = await service.cancelBooking(actor, {
      bookingId: booking.id,
      reason: 'customer request',
      idempotencyKey: 'cancel-pending',
    });
    const availability = await service.getDepartureAvailability(actor, departure.id);

    expect(cancelled.status).toBe('cancelled');
    expect(availability.reservedSeats).toBe(0);
    expect(availability.availableSeats).toBe(2);
  });

  it('releases confirmed seats when a confirmed booking is cancelled', async () => {
    const { service } = createService();
    const { departure } = await createOpenDeparture(service, 2);
    const booking = await service.createBooking(actor, {
      departureId: departure.id,
      bookingCode: 'BKG-CANCEL-CONFIRMED',
      bookerPartyId: 'party-booker',
      participants: [{ partyId: 'party-booker', displayName: 'Booker', participantType: 'adult' }],
      idempotencyKey: 'booking-cancel-confirmed',
    });
    await service.confirmBooking(actor, { bookingId: booking.id, idempotencyKey: 'confirm-cancelled' });

    await service.cancelBooking(actor, {
      bookingId: booking.id,
      reason: 'operator request',
      idempotencyKey: 'cancel-confirmed',
    });
    const availability = await service.getDepartureAvailability(actor, departure.id);

    expect(availability.confirmedSeats).toBe(0);
    expect(availability.availableSeats).toBe(2);
  });

  it('requires explicit Tourism OS authorization before state mutation', async () => {
    const { service } = createService(new Set<TourismPermission>());

    await expect(
      service.createTour(actor, {
        tourCode: 'DENIED',
        name: 'Denied',
        idempotencyKey: 'denied',
      }),
    ).rejects.toBeInstanceOf(TourismAuthorizationError);
  });

  it('does not allow confirming an already cancelled booking', async () => {
    const { service } = createService();
    const { departure } = await createOpenDeparture(service, 1);
    const booking = await service.createBooking(actor, {
      departureId: departure.id,
      bookingCode: 'BKG-CANCEL-FIRST',
      bookerPartyId: 'party-booker',
      participants: [{ partyId: 'party-booker', displayName: 'Booker', participantType: 'adult' }],
      idempotencyKey: 'booking-cancel-first',
    });
    await service.cancelBooking(actor, { bookingId: booking.id, idempotencyKey: 'cancel-first' });

    await expect(service.confirmBooking(actor, { bookingId: booking.id, idempotencyKey: 'confirm-after-cancel' })).rejects.toBeInstanceOf(
      TourismStateError,
    );
  });
});
