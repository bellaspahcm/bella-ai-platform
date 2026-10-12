import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResult, type QueryResultRow } from 'pg';

import { TourismCapacityError, TourismNotFoundError } from '../domain/errors';
import type { CreateBookingCommand, TourismActor } from '../domain/types';
import { FixedTourismClock } from '../in-memory.repository';
import { PostgresTourismRepository } from '../postgres.repository';
import { TourismFoundationService } from '../tourism-foundation.service';
import type { TourismAuthorizationPort, TourismIdFactory, TourismPermission } from '../ports';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadTourismE2eEnv();

const dbUrl = process.env.DATABASE_EXECUTOR_URL_TEST?.trim() ?? '';
const dbConfigError = validateTourismE2eDbConfig(dbUrl);
const migrationSql = readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20261012020000_create_tourism_os_foundation.sql'),
  'utf8',
);

class AuthenticatedTourismSqlClient {
  private configured = false;

  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string },
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    const command = sql.trim().toUpperCase();
    if (command === 'BEGIN') {
      await this.client.query('BEGIN');
      await this.applyLocalContext();
      return emptyResult<Row>();
    }
    if (command === 'COMMIT') {
      const result = await this.client.query<Row>('COMMIT');
      this.configured = false;
      return result;
    }
    if (command === 'ROLLBACK') {
      const result = await this.client.query<Row>('ROLLBACK');
      this.configured = false;
      return result;
    }
    await this.ensureSessionContext();
    return this.client.query<Row>(sql, values ? [...values] : undefined);
  }

  private async ensureSessionContext(): Promise<void> {
    if (this.configured) return;
    await this.client.query('SET ROLE authenticated');
    await this.client.query('SET row_security = on');
    await this.applySessionContext();
    this.configured = true;
  }

  private async applyLocalContext(): Promise<void> {
    await this.client.query('SET LOCAL ROLE authenticated');
    await this.client.query('SET LOCAL row_security = on');
    await this.client.query(
      `
        SELECT
          set_config('app.current_user_id', $1, TRUE),
          set_config('app.current_tenant_id', $2, TRUE),
          set_config('request.jwt.claim.sub', $1, TRUE),
          set_config('request.jwt.claim.role', 'authenticated', TRUE),
          set_config('request.jwt.claim.tenant_id', $2, TRUE),
          set_config('request.jwt.claims', $3, TRUE)
      `,
      [this.context.userId, this.context.tenantId, jwtClaims(this.context)],
    );
  }

  private async applySessionContext(): Promise<void> {
    await this.client.query(
      `
        SELECT
          set_config('app.current_user_id', $1, FALSE),
          set_config('app.current_tenant_id', $2, FALSE),
          set_config('request.jwt.claim.sub', $1, FALSE),
          set_config('request.jwt.claim.role', 'authenticated', FALSE),
          set_config('request.jwt.claim.tenant_id', $2, FALSE),
          set_config('request.jwt.claims', $3, FALSE)
      `,
      [this.context.userId, this.context.tenantId, jwtClaims(this.context)],
    );
  }
}

class AllowAllTourismAuthorization implements TourismAuthorizationPort {
  async ensureAllowed(_actor: TourismActor, _permission: TourismPermission): Promise<void> {
    return undefined;
  }
}

class UuidTourismIdFactory implements TourismIdFactory {
  nextId(_prefix: string): string {
    return randomUUID();
  }
}

type CountRow = QueryResultRow & { count: string };
type SchemaReadinessRow = QueryResultRow & {
  tours_exists: boolean;
  packages_exists: boolean;
  days_exists: boolean;
  segments_exists: boolean;
  departures_exists: boolean;
  bookings_exists: boolean;
  participants_exists: boolean;
  idempotency_exists: boolean;
  audit_exists: boolean;
};

function jwtClaims(context: { userId: string; tenantId: string }): string {
  return JSON.stringify({
    sub: context.userId,
    role: 'authenticated',
    tenant_id: context.tenantId,
    app_metadata: {
      tenant_id: context.tenantId,
      role: 'authenticated',
    },
  });
}

describe('Tourism OS Foundation Real DB and RLS proof', () => {
  jest.setTimeout(180_000);

  const marker = `tourism-os-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    bookerA: randomUUID(),
    guestA: randomUUID(),
    bookerB: randomUUID(),
  };

  let admin: Client;
  let setupError: Error | null = null;

  beforeAll(async () => {
    if (dbConfigError) {
      throw dbConfigError;
    }
    try {
      admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      await admin.connect();
      await admin.query(migrationSql);
      await assertRequiredTourismSchema(admin);
      await seedTenant(ids.tenantA, `${marker} Tenant A`);
      await seedTenant(ids.tenantB, `${marker} Tenant B`);
      await seedUser(ids.userA, ids.tenantA, `${marker}-a@example.com`);
      await seedUser(ids.userB, ids.tenantB, `${marker}-b@example.com`);
      await seedParty(ids.bookerA, ids.tenantA, `${marker} Booker A`);
      await seedParty(ids.guestA, ids.tenantA, `${marker} Guest A`);
      await seedParty(ids.bookerB, ids.tenantB, `${marker} Booker B`);
    } catch (error) {
      setupError = error instanceof Error ? error : new Error(String(error));
      throw setupError;
    }
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      if (!setupError) {
        await cleanupFixtures();
      }
    } finally {
      await admin.end().catch(() => undefined);
    }
  });

  it('runs the OS booking lifecycle, idempotency, audit, and cross-tenant RLS through Postgres', async () => {
    if (setupError) throw setupError;
    const tenantA = await createService(ids.userA, ids.tenantA);
    const tenantB = await createService(ids.userB, ids.tenantB);
    try {
      const departure = await createOpenDeparture(tenantA.service, tenantA.actor, 4, 'main');
      const command = bookingCommand(departure.id, 'main-booking', [ids.bookerA, ids.guestA]);
      const booking = await tenantA.service.createBooking(tenantA.actor, command);
      const duplicate = await tenantA.service.createBooking(tenantA.actor, command);

      expect(duplicate.id).toBe(booking.id);

      const pending = await tenantA.service.getDepartureAvailability(tenantA.actor, departure.id);
      expect(pending.reservedSeats).toBe(2);
      expect(pending.availableSeats).toBe(2);

      const confirmed = await tenantA.service.confirmBooking(tenantA.actor, {
        bookingId: booking.id,
        idempotencyKey: `${marker}-confirm-main`,
      });
      expect(confirmed.status).toBe('confirmed');

      const cancelled = await tenantA.service.cancelBooking(tenantA.actor, {
        bookingId: booking.id,
        reason: 'real db proof',
        idempotencyKey: `${marker}-cancel-main`,
      });
      expect(cancelled.status).toBe('cancelled');

      const released = await tenantA.service.getDepartureAvailability(tenantA.actor, departure.id);
      expect(released.confirmedSeats).toBe(0);
      expect(released.availableSeats).toBe(4);

      await expectParticipantCount(ids.tenantA, booking.id, 2);
      await expectAuditCount(ids.tenantA, 7);
      await expectCommandCount(ids.tenantA, 7);
      await expect(tenantB.service.getDepartureAvailability(tenantB.actor, departure.id)).rejects.toBeInstanceOf(
        TourismNotFoundError,
      );
      await expectCrossTenantReadReturnsEmpty(tenantB.client, booking.id);
    } finally {
      await tenantA.client.end();
      await tenantB.client.end();
    }
  });

  it('serializes concurrent booking attempts and prevents overselling capacity', async () => {
    if (setupError) throw setupError;
    const setup = await createService(ids.userA, ids.tenantA);
    const first = await createService(ids.userA, ids.tenantA);
    const second = await createService(ids.userA, ids.tenantA);
    try {
      const departure = await createOpenDeparture(setup.service, setup.actor, 1, 'concurrency');
      const firstCommand = bookingCommand(departure.id, 'concurrent-a', [ids.bookerA]);
      const secondCommand = bookingCommand(departure.id, 'concurrent-b', [ids.guestA]);

      const results = await Promise.allSettled([
        first.service.createBooking(first.actor, firstCommand),
        second.service.createBooking(second.actor, secondCommand),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(TourismCapacityError);

      const availability = await setup.service.getDepartureAvailability(setup.actor, departure.id);
      expect(availability.reservedSeats).toBe(1);
      expect(availability.availableSeats).toBe(0);
      await expectBookingCount(ids.tenantA, departure.id, 1);
    } finally {
      await setup.client.end();
      await first.client.end();
      await second.client.end();
    }
  });

  async function createService(userId: string, tenantId: string): Promise<{
    actor: TourismActor;
    client: Client;
    service: TourismFoundationService;
  }> {
    const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const actor: TourismActor = {
      tenantId,
      userId,
      roles: ['tourism_operator'],
    };
    return {
      actor,
      client,
      service: new TourismFoundationService({
        repository: new PostgresTourismRepository(new AuthenticatedTourismSqlClient(client, { userId, tenantId })),
        authorization: new AllowAllTourismAuthorization(),
        clock: new FixedTourismClock(new Date('2026-10-12T00:00:00.000Z')),
        idFactory: new UuidTourismIdFactory(),
      }),
    };
  }

  async function createOpenDeparture(
    service: TourismFoundationService,
    actor: TourismActor,
    capacityTotal: number,
    suffix: string,
  ) {
    const tour = await service.createTour(actor, {
      tourCode: `${marker}-${suffix}-tour`,
      name: `${marker} Tour ${suffix}`,
      idempotencyKey: `${marker}-${suffix}-tour`,
    });
    const tourPackage = await service.createTourPackage(actor, {
      tourId: tour.id,
      packageCode: `${marker}-${suffix}-package`,
      name: `${marker} Package ${suffix}`,
      idempotencyKey: `${marker}-${suffix}-package`,
    });
    const day = await service.addItineraryDay(actor, {
      tourId: tour.id,
      packageId: tourPackage.id,
      dayNumber: 1,
      title: `${marker} Day ${suffix}`,
      idempotencyKey: `${marker}-${suffix}-day`,
    });
    await service.addItinerarySegment(actor, {
      itineraryDayId: day.id,
      sequence: 1,
      title: `${marker} Segment ${suffix}`,
      startLocation: 'Da Nang',
      endLocation: 'Hoi An',
      startsAt: '08:00',
      endsAt: '10:00',
      idempotencyKey: `${marker}-${suffix}-segment`,
    });
    return service.openDeparture(actor, {
      tourId: tour.id,
      packageId: tourPackage.id,
      departureCode: `${marker}-${suffix}-departure`,
      startsOn: '2026-11-01',
      endsOn: '2026-11-03',
      capacityTotal,
      idempotencyKey: `${marker}-${suffix}-departure`,
    });
  }

  function bookingCommand(departureId: string, suffix: string, partyIds: readonly string[]): CreateBookingCommand {
    return {
      departureId,
      bookingCode: `${marker}-${suffix}`,
      bookerPartyId: partyIds[0],
      participants: partyIds.map((partyId, index) => ({
        partyId,
        displayName: `${marker} Participant ${suffix} ${index + 1}`,
        participantType: 'adult',
      })),
      idempotencyKey: `${marker}-${suffix}-idem`,
    };
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.tenants (id, name, status, enabled_modules)
        VALUES ($1::uuid, $2, 'active', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [tenantId, name],
    );
  }

  async function seedUser(userId: string, tenantId: string, email: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          $1::uuid,
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [userId, email],
    );
    await admin.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'admin', 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [userId, tenantId, email, `${marker} Operator`],
    );
  }

  async function seedParty(partyId: string, tenantId: string, displayName: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.party_parties (id, tenant_id, party_type, display_name, created_by, updated_by)
        VALUES ($1::uuid, $2::uuid, 'person', $3, $4::uuid, $4::uuid)
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            party_type = EXCLUDED.party_type,
            display_name = EXCLUDED.display_name,
            updated_by = EXCLUDED.updated_by
      `,
      [partyId, tenantId, displayName, tenantId === ids.tenantA ? ids.userA : ids.userB],
    );
  }

  async function expectParticipantCount(tenantId: string, bookingId: string, expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.tourism_participants WHERE tenant_id = $1::uuid AND booking_id = $2::uuid',
      [tenantId, bookingId],
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectAuditCount(tenantId: string, minimum: number): Promise<void> {
    const result = await admin.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.tourism_audit_events WHERE tenant_id = $1::uuid',
      [tenantId],
    );
    expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(minimum);
  }

  async function expectCommandCount(tenantId: string, minimum: number): Promise<void> {
    const result = await admin.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.tourism_command_idempotency WHERE tenant_id = $1::uuid',
      [tenantId],
    );
    expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(minimum);
  }

  async function expectCrossTenantReadReturnsEmpty(client: Client, bookingId: string): Promise<void> {
    const result = await client.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.tourism_bookings WHERE id = $1::uuid',
      [bookingId],
    );
    expect(Number(result.rows[0].count)).toBe(0);
  }

  async function expectBookingCount(tenantId: string, departureId: string, expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.tourism_bookings WHERE tenant_id = $1::uuid AND departure_id = $2::uuid',
      [tenantId, departureId],
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    const tenantIds = [ids.tenantA, ids.tenantB];
    await admin.query('DELETE FROM public.tourism_participants WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_bookings WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_departures WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_itinerary_segments WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_itinerary_days WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_tour_packages WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_tours WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_audit_events WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.tourism_command_idempotency WHERE tenant_id = ANY($1::uuid[])', [tenantIds]);
    await admin.query('DELETE FROM public.party_parties WHERE tenant_id = ANY($1::uuid[])', [tenantIds]).catch(() => undefined);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    await admin.query('DELETE FROM public.tenants WHERE id = ANY($1::uuid[])', [tenantIds]).catch(() => undefined);
  }
});

async function assertRequiredTourismSchema(client: Client): Promise<void> {
  const result = await client.query<SchemaReadinessRow>(
    `
      SELECT
        to_regclass('public.tourism_tours') IS NOT NULL AS tours_exists,
        to_regclass('public.tourism_tour_packages') IS NOT NULL AS packages_exists,
        to_regclass('public.tourism_itinerary_days') IS NOT NULL AS days_exists,
        to_regclass('public.tourism_itinerary_segments') IS NOT NULL AS segments_exists,
        to_regclass('public.tourism_departures') IS NOT NULL AS departures_exists,
        to_regclass('public.tourism_bookings') IS NOT NULL AS bookings_exists,
        to_regclass('public.tourism_participants') IS NOT NULL AS participants_exists,
        to_regclass('public.tourism_command_idempotency') IS NOT NULL AS idempotency_exists,
        to_regclass('public.tourism_audit_events') IS NOT NULL AS audit_exists
    `,
  );
  const row = result.rows[0];
  const missing: string[] = [];
  if (!row.tours_exists) missing.push('public.tourism_tours');
  if (!row.packages_exists) missing.push('public.tourism_tour_packages');
  if (!row.days_exists) missing.push('public.tourism_itinerary_days');
  if (!row.segments_exists) missing.push('public.tourism_itinerary_segments');
  if (!row.departures_exists) missing.push('public.tourism_departures');
  if (!row.bookings_exists) missing.push('public.tourism_bookings');
  if (!row.participants_exists) missing.push('public.tourism_participants');
  if (!row.idempotency_exists) missing.push('public.tourism_command_idempotency');
  if (!row.audit_exists) missing.push('public.tourism_audit_events');
  if (missing.length > 0) {
    throw new Error(`Tourism OS Real DB schema is not ready. Missing: ${missing.join(', ')}`);
  }
}

function loadTourismE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    if (path.basename(filePath) === '.env.e2e') {
      if (parsed.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.E2E_SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (parsed.DATABASE_EXECUTOR_URL_TEST && !process.env.DATABASE_EXECUTOR_URL_TEST?.trim()) {
        process.env.DATABASE_EXECUTOR_URL_TEST = parsed.DATABASE_EXECUTOR_URL_TEST;
      }
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
}

function candidateE2eEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve('D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => path.resolve(filePath)))];
}

function isAllowedE2eProject(): boolean {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  try {
    return new URL(supabaseUrl).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function validateTourismE2eDbConfig(value: string): Error | null {
  if (!value) {
    return new Error(
      'DATABASE_EXECUTOR_URL_TEST is required for Tourism OS Real DB E2E. No fallback to shared executor URLs is allowed.',
    );
  }
  if (!isAllowedE2eProject()) {
    return new Error(`Tourism OS Real DB E2E requires canonical Supabase project ${EXPECTED_E2E_PROJECT_REF}.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return new Error('DATABASE_EXECUTOR_URL_TEST must be a valid PostgreSQL URL.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return new Error('DATABASE_EXECUTOR_URL_TEST must use a PostgreSQL protocol.');
  }
  if (!parsed.hostname || parsed.hostname === 'base') {
    return new Error('DATABASE_EXECUTOR_URL_TEST must include a concrete PostgreSQL host.');
  }
  if (resolveSupabaseProjectRef(parsed) !== EXPECTED_E2E_PROJECT_REF) {
    return new Error(`DATABASE_EXECUTOR_URL_TEST must target canonical E2E project ${EXPECTED_E2E_PROJECT_REF}.`);
  }

  return null;
}

function resolveSupabaseProjectRef(parsed: URL): string | null {
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === EXPECTED_E2E_SUPABASE_HOST) return EXPECTED_E2E_PROJECT_REF;
  if (hostname === `db.${EXPECTED_E2E_SUPABASE_HOST}`) return EXPECTED_E2E_PROJECT_REF;

  const username = decodeURIComponent(parsed.username);
  const poolerUserMatch = /^postgres\.([a-z0-9]+)$/i.exec(username);
  return poolerUserMatch?.[1].toLowerCase() ?? null;
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function emptyResult<Row extends QueryResultRow>(): QueryResult<Row> {
  return {
    command: '',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  };
}
