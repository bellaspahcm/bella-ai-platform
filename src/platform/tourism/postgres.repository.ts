import type { QueryResultRow } from 'pg';

import type {
  Booking,
  Departure,
  ItineraryDay,
  ItinerarySegment,
  Participant,
  Tour,
  TourPackage,
  TourismAuditEvent,
  TourismCommandRecord,
  TourismId,
  TourismTenantId,
} from './domain/types';
import type { TourismRepository } from './ports';

export interface TourismSqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

type TourRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  tour_code: string;
  name: string;
  description: string | null;
  status: Tour['status'];
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type PackageRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  tour_id: string;
  package_code: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type ItineraryDayRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  tour_id: string;
  package_id: string;
  day_number: string | number;
  title: string;
  notes: string | null;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type DepartureRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  tour_id: string;
  package_id: string;
  departure_code: string;
  starts_on: string | Date;
  ends_on: string | Date;
  capacity_total: string | number;
  capacity_reserved: string | number;
  capacity_confirmed: string | number;
  status: Departure['status'];
  opened_by: string;
  opened_at: string | Date;
  updated_at: string | Date;
};

type BookingRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  departure_id: string;
  booking_code: string;
  status: Booking['status'];
  booker_party_id: string;
  seat_count: string | number;
  idempotency_key: string;
  created_by: string;
  confirmed_by: string | null;
  cancelled_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type CommandRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  operation: string;
  business_key: string;
  payload_hash: string;
  result: unknown;
  created_at: string | Date;
};

type AuditRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  metadata: unknown;
  created_at: string | Date;
};

export class PostgresTourismRepository implements TourismRepository {
  constructor(private readonly db: TourismSqlClient) {}

  async withTransaction<T>(work: (repository: TourismRepository) => Promise<T>): Promise<T> {
    await this.db.query('BEGIN');
    try {
      const result = await work(this);
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async findCommandRecord(
    tenantId: TourismTenantId,
    operation: string,
    businessKey: string,
  ): Promise<TourismCommandRecord | null> {
    const result = await this.db.query<CommandRow>(
      `SELECT *
       FROM public.tourism_command_idempotency
       WHERE tenant_id = $1::uuid
         AND operation = $2
         AND business_key = $3
       LIMIT 1`,
      [tenantId, operation, businessKey],
    );
    return result.rows[0] ? this.mapCommand(result.rows[0]) : null;
  }

  async saveCommandRecord(record: TourismCommandRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_command_idempotency
        (id, tenant_id, operation, business_key, payload_hash, result, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7)`,
      [record.id, record.tenantId, record.operation, record.businessKey, record.payloadHash, JSON.stringify(record.result), record.createdAt],
    );
  }

  async findTour(tenantId: TourismTenantId, tourId: TourismId): Promise<Tour | null> {
    const result = await this.db.query<TourRow>(
      'SELECT * FROM public.tourism_tours WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
      [tenantId, tourId],
    );
    return result.rows[0] ? this.mapTour(result.rows[0]) : null;
  }

  async saveTour(tour: Tour): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_tours
        (id, tenant_id, tour_code, name, description, status, created_by, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
        tour_code = EXCLUDED.tour_code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at`,
      [tour.id, tour.tenantId, tour.tourCode, tour.name, tour.description ?? null, tour.status, tour.createdBy, tour.createdAt, tour.updatedAt],
    );
  }

  async findTourPackage(tenantId: TourismTenantId, packageId: TourismId): Promise<TourPackage | null> {
    const result = await this.db.query<PackageRow>(
      'SELECT * FROM public.tourism_tour_packages WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
      [tenantId, packageId],
    );
    return result.rows[0] ? this.mapPackage(result.rows[0]) : null;
  }

  async saveTourPackage(tourPackage: TourPackage): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_tour_packages
        (id, tenant_id, tour_id, package_code, name, description, created_by, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
        package_code = EXCLUDED.package_code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = EXCLUDED.updated_at`,
      [
        tourPackage.id,
        tourPackage.tenantId,
        tourPackage.tourId,
        tourPackage.packageCode,
        tourPackage.name,
        tourPackage.description ?? null,
        tourPackage.createdBy,
        tourPackage.createdAt,
        tourPackage.updatedAt,
      ],
    );
  }

  async findItineraryDay(tenantId: TourismTenantId, itineraryDayId: TourismId): Promise<ItineraryDay | null> {
    const result = await this.db.query<ItineraryDayRow>(
      'SELECT * FROM public.tourism_itinerary_days WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
      [tenantId, itineraryDayId],
    );
    return result.rows[0] ? this.mapItineraryDay(result.rows[0]) : null;
  }

  async saveItineraryDay(day: ItineraryDay): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_itinerary_days
        (id, tenant_id, tour_id, package_id, day_number, title, notes, created_by, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8::uuid, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
        day_number = EXCLUDED.day_number,
        title = EXCLUDED.title,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at`,
      [day.id, day.tenantId, day.tourId, day.packageId, day.dayNumber, day.title, day.notes ?? null, day.createdBy, day.createdAt, day.updatedAt],
    );
  }

  async saveItinerarySegment(segment: ItinerarySegment): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_itinerary_segments
        (id, tenant_id, itinerary_day_id, sequence, title, start_location, end_location, starts_at, ends_at, notes, created_by, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::time, $9::time, $10, $11::uuid, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
        sequence = EXCLUDED.sequence,
        title = EXCLUDED.title,
        start_location = EXCLUDED.start_location,
        end_location = EXCLUDED.end_location,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at`,
      [
        segment.id,
        segment.tenantId,
        segment.itineraryDayId,
        segment.sequence,
        segment.title,
        segment.startLocation ?? null,
        segment.endLocation ?? null,
        segment.startsAt ?? null,
        segment.endsAt ?? null,
        segment.notes ?? null,
        segment.createdBy,
        segment.createdAt,
        segment.updatedAt,
      ],
    );
  }

  async lockDeparture(tenantId: TourismTenantId, departureId: TourismId): Promise<Departure | null> {
    const result = await this.db.query<DepartureRow>(
      `SELECT *
       FROM public.tourism_departures
       WHERE tenant_id = $1::uuid
         AND id = $2::uuid
       FOR UPDATE`,
      [tenantId, departureId],
    );
    return result.rows[0] ? this.mapDeparture(result.rows[0]) : null;
  }

  async saveDeparture(departure: Departure): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_departures
        (id, tenant_id, tour_id, package_id, departure_code, starts_on, ends_on, capacity_total, capacity_reserved, capacity_confirmed, status, opened_by, opened_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::date, $7::date, $8, $9, $10, $11, $12::uuid, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
        departure_code = EXCLUDED.departure_code,
        starts_on = EXCLUDED.starts_on,
        ends_on = EXCLUDED.ends_on,
        capacity_total = EXCLUDED.capacity_total,
        capacity_reserved = EXCLUDED.capacity_reserved,
        capacity_confirmed = EXCLUDED.capacity_confirmed,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at`,
      [
        departure.id,
        departure.tenantId,
        departure.tourId,
        departure.packageId,
        departure.departureCode,
        departure.startsOn,
        departure.endsOn,
        departure.capacityTotal,
        departure.capacityReserved,
        departure.capacityConfirmed,
        departure.status,
        departure.openedBy,
        departure.openedAt,
        departure.updatedAt,
      ],
    );
  }

  async findBooking(tenantId: TourismTenantId, bookingId: TourismId): Promise<Booking | null> {
    const result = await this.db.query<BookingRow>(
      'SELECT * FROM public.tourism_bookings WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1',
      [tenantId, bookingId],
    );
    return result.rows[0] ? this.mapBooking(result.rows[0]) : null;
  }

  async saveBooking(booking: Booking): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_bookings
        (id, tenant_id, departure_id, booking_code, status, booker_party_id, seat_count, idempotency_key, created_by, confirmed_by, cancelled_by, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7, $8, $9::uuid, $10::uuid, $11::uuid, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        confirmed_by = EXCLUDED.confirmed_by,
        cancelled_by = EXCLUDED.cancelled_by,
        updated_at = EXCLUDED.updated_at`,
      [
        booking.id,
        booking.tenantId,
        booking.departureId,
        booking.bookingCode,
        booking.status,
        booking.bookerPartyId,
        booking.seatCount,
        booking.idempotencyKey,
        booking.createdBy,
        booking.confirmedBy ?? null,
        booking.cancelledBy ?? null,
        booking.createdAt,
        booking.updatedAt,
      ],
    );
  }

  async saveParticipants(participants: readonly Participant[]): Promise<void> {
    for (const participant of participants) {
      await this.db.query(
        `INSERT INTO public.tourism_participants
          (id, tenant_id, booking_id, party_id, display_name, participant_type, created_by, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::uuid, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          participant_type = EXCLUDED.participant_type,
          updated_at = EXCLUDED.updated_at`,
        [
          participant.id,
          participant.tenantId,
          participant.bookingId,
          participant.partyId,
          participant.displayName,
          participant.participantType,
          participant.createdBy,
          participant.createdAt,
          participant.updatedAt,
        ],
      );
    }
  }

  async appendAuditEvent(event: TourismAuditEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO public.tourism_audit_events
        (id, tenant_id, entity_type, entity_id, action, actor_id, metadata, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6::uuid, $7::jsonb, $8)`,
      [
        event.id,
        event.tenantId,
        event.entityType,
        event.entityId,
        event.action,
        event.actorId,
        JSON.stringify(event.metadata),
        event.createdAt,
      ],
    );
  }

  async listAuditEvents(tenantId: TourismTenantId): Promise<readonly TourismAuditEvent[]> {
    const result = await this.db.query<AuditRow>(
      'SELECT * FROM public.tourism_audit_events WHERE tenant_id = $1::uuid ORDER BY created_at, id',
      [tenantId],
    );
    return result.rows.map((row) => this.mapAudit(row));
  }

  private mapTour(row: TourRow): Tour {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tourCode: row.tour_code,
      name: row.name,
      description: row.description ?? undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  private mapPackage(row: PackageRow): TourPackage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tourId: row.tour_id,
      packageCode: row.package_code,
      name: row.name,
      description: row.description ?? undefined,
      createdBy: row.created_by,
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  private mapItineraryDay(row: ItineraryDayRow): ItineraryDay {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tourId: row.tour_id,
      packageId: row.package_id,
      dayNumber: Number(row.day_number),
      title: row.title,
      notes: row.notes ?? undefined,
      createdBy: row.created_by,
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  private mapDeparture(row: DepartureRow): Departure {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tourId: row.tour_id,
      packageId: row.package_id,
      departureCode: row.departure_code,
      startsOn: this.toDateString(row.starts_on),
      endsOn: this.toDateString(row.ends_on),
      capacityTotal: Number(row.capacity_total),
      capacityReserved: Number(row.capacity_reserved),
      capacityConfirmed: Number(row.capacity_confirmed),
      status: row.status,
      openedBy: row.opened_by,
      openedAt: this.toDate(row.opened_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  private mapBooking(row: BookingRow): Booking {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      departureId: row.departure_id,
      bookingCode: row.booking_code,
      status: row.status,
      bookerPartyId: row.booker_party_id,
      seatCount: Number(row.seat_count),
      idempotencyKey: row.idempotency_key,
      createdBy: row.created_by,
      confirmedBy: row.confirmed_by ?? undefined,
      cancelledBy: row.cancelled_by ?? undefined,
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  private mapCommand(row: CommandRow): TourismCommandRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      operation: row.operation,
      businessKey: row.business_key,
      payloadHash: row.payload_hash,
      result: this.toRecord(row.result),
      createdAt: this.toDate(row.created_at),
    };
  }

  private mapAudit(row: AuditRow): TourismAuditEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      actorId: row.actor_id,
      metadata: this.toRecord(row.metadata),
      createdAt: this.toDate(row.created_at),
    };
  }

  private toDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toDateString(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return value.slice(0, 10);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
