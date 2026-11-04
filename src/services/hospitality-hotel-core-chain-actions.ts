'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { Client, type QueryResultRow } from 'pg';

import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';
import { productResolver, type TenantIdentity } from '@/platform/registry/product-resolver';
import {
  HospitalityFolioPaymentRepository,
  HospitalityFolioPaymentService,
  HospitalityFrontOfficeStayRepository,
  HospitalityFrontOfficeStayService,
  HospitalityGuestReservationRepository,
  HospitalityGuestReservationService,
  HospitalityPropertyRoomRepository,
  HospitalityPropertyRoomService,
  type HospitalityFolioCurrency,
  type HospitalitySqlClient,
} from '@/products/bella-hospitality';
import type { Database } from '@/types/database.types';

const HOSPITALITY_PRODUCT_KEY = 'bella_hospitality';
const HOTEL_CORE_CHAIN_ROUTE = '/hospitality/hotel-core-chain';

export type HospitalityHotelCoreChainActionResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface HospitalityHotelCoreChainActionInput {
  readonly marker: string;
  readonly guestPartyId: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly amountMinor: number;
  readonly currency?: HospitalityFolioCurrency;
  readonly paymentMethod?: string;
}

export interface HospitalityHotelCoreChainActionValue {
  readonly productKey: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly propertyId: string;
  readonly roomId: string;
  readonly guestId: string;
  readonly reservationId: string;
  readonly reservationRoomId: string;
  readonly stayId: string;
  readonly stayStatus: string;
  readonly occupancyId: string;
  readonly occupancyStatus: string;
  readonly folioId: string;
  readonly folioStatus: string;
  readonly folioOutstandingAmountMinor: number;
  readonly folioPaidAmountMinor: number;
  readonly folioItemId: string;
  readonly financeInvoiceId: string;
  readonly financeAllocationId: string;
  readonly financeCashMovementId: string;
  readonly financeAllocatedAmountMinor: number;
}

type PgRows<Row extends Record<string, unknown>> = {
  readonly rows: Row[];
};

type HospitalityAuthContext = {
  readonly userId: string;
  readonly tenantId: string;
};

type TenantProductRow = {
  readonly id: string;
  readonly product_key: string | null;
};

class PgHospitalitySqlClient implements HospitalitySqlClient {
  private inTransaction = false;
  private transactionBound = false;

  constructor(
    private readonly client: Client,
    private readonly authContext: HospitalityAuthContext
  ) {}

  async query<Row extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<PgRows<Row>> {
    const statement = firstSqlStatement(sql);

    if (statement === 'BEGIN') {
      const result = await this.client.query<Row & QueryResultRow>(
        sql,
        values ? [...values] : undefined
      );
      this.inTransaction = true;
      this.transactionBound = false;
      await bindAuthenticatedHospitalityTransaction(this.client, this.authContext);
      this.transactionBound = true;
      return { rows: result.rows };
    }

    if (statement === 'COMMIT' || statement === 'ROLLBACK') {
      try {
        const result = await this.client.query<Row & QueryResultRow>(
          sql,
          values ? [...values] : undefined
        );
        return { rows: result.rows };
      } finally {
        this.inTransaction = false;
        this.transactionBound = false;
      }
    }

    if (this.inTransaction) {
      if (!this.transactionBound) {
        await bindAuthenticatedHospitalityTransaction(this.client, this.authContext);
        this.transactionBound = true;
      }
    } else {
      await bindAuthenticatedHospitalitySession(this.client, this.authContext);
    }

    const result = await this.client.query<Row & QueryResultRow>(
      sql,
      values ? [...values] : undefined
    );
    return { rows: result.rows };
  }
}

export async function executeHospitalityHotelCoreChainAction(
  input: HospitalityHotelCoreChainActionInput
): Promise<HospitalityHotelCoreChainActionResult<HospitalityHotelCoreChainActionValue>> {
  const authContext = await resolveHospitalityAuthContext();
  if (!authContext.ok) return authContext;

  return executeHospitalityHotelCoreChainWithContext(input, authContext.value);
}

export async function executeHospitalityHotelCoreChainWithContext(
  input: HospitalityHotelCoreChainActionInput,
  authContext: HospitalityAuthContext
): Promise<HospitalityHotelCoreChainActionResult<HospitalityHotelCoreChainActionValue>> {
  const validation = validateInput(input);
  if (!validation.ok) return validation;

  const dbUrl = getHospitalityDatabaseUrl();
  if (!dbUrl) {
    return failure(
      'HOSPITALITY_CHAIN_DB_URL_MISSING',
      'Hospitality Hotel Core chain requires SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL.'
    );
  }

  const db = new Client({
    connectionString: dbUrl,
    ssl: sslConfig(dbUrl),
  });

  await db.connect();

  try {
    const tenant = await readTenantIdentity(db, authContext.tenantId);
    const resolvedProduct = productResolver.resolve(tenant);
    if (resolvedProduct.product.productKey !== HOSPITALITY_PRODUCT_KEY) {
      return failure(
        'HOSPITALITY_CHAIN_PRODUCT_MISMATCH',
        `Expected ${HOSPITALITY_PRODUCT_KEY}, received ${resolvedProduct.product.productKey}.`
      );
    }

    await bindAuthenticatedHospitalitySession(db, authContext);

    const sqlClient = new PgHospitalitySqlClient(db, authContext);
    const propertyService = new HospitalityPropertyRoomService(
      new HospitalityPropertyRoomRepository(sqlClient)
    );
    const reservationService = new HospitalityGuestReservationService(
      new HospitalityGuestReservationRepository(sqlClient)
    );
    const frontOfficeService = new HospitalityFrontOfficeStayService(
      new HospitalityFrontOfficeStayRepository(sqlClient)
    );
    const folioService = new HospitalityFolioPaymentService(
      new HospitalityFolioPaymentRepository(sqlClient),
      createFinanceContract()
    );

    const suffix = normalizeMarker(input.marker);
    const metadata = {
      proof_marker: suffix,
      proof_scope: 'HOSPITALITY_HOTEL_CORE_FULL_CHAIN_SEAL',
      product_key: HOSPITALITY_PRODUCT_KEY,
    };

    const foundation = await propertyService.createPropertyRoomFoundation({
      tenantId: authContext.tenantId,
      property: {
        code: `HC-${suffix}`,
        name: `Hotel Core ${suffix}`,
        propertyType: 'hotel',
        timezone: 'Asia/Ho_Chi_Minh',
        metadata,
      },
      building: {
        code: `BLD-${suffix}`,
        name: `Main Tower ${suffix}`,
        metadata,
      },
      floor: {
        floorNumber: 1,
        code: `L1-${suffix}`,
        name: `Level 1 ${suffix}`,
        metadata,
      },
      roomType: {
        code: `RT-${suffix}`,
        name: `Deluxe ${suffix}`,
        maxOccupancy: 2,
        baseAdults: 2,
        bedConfig: { bed: 'king' },
        metadata,
      },
      room: {
        roomNumber: `R-${suffix.slice(0, 18)}`,
        displayName: `Room ${suffix}`,
        metadata,
      },
    });

    const reservationChain = await reservationService.createGuestReservation({
      tenantId: authContext.tenantId,
      propertyId: foundation.property.id,
      guest: {
        partyId: input.guestPartyId,
        metadata,
      },
      reservation: {
        reservationCode: `RSV-${suffix}`,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adults: 1,
        children: 0,
        metadata,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
        metadata,
      },
    });

    const checkedInAt = `${input.checkInDate}T06:00:00.000Z`;
    const frontOffice = await frontOfficeService.checkIn({
      tenantId: authContext.tenantId,
      propertyId: foundation.property.id,
      reservationId: reservationChain.reservation.id,
      guestId: reservationChain.guest.id,
      reservationRoomId: reservationChain.reservedRoom.id,
      roomId: foundation.room.id,
      checkedInAt,
      metadata,
    });

    const folio = await folioService.openFolio({
      tenantId: authContext.tenantId,
      propertyId: foundation.property.id,
      stayId: frontOffice.stay.id,
      guestId: reservationChain.guest.id,
      currency: input.currency ?? 'VND',
      openedAt: checkedInAt,
      metadata,
    });

    const charge = await folioService.postRoomCharge({
      tenantId: authContext.tenantId,
      folioId: folio.id,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'VND',
      servicePeriodStart: input.checkInDate,
      servicePeriodEnd: input.checkOutDate,
      recognitionDate: input.checkOutDate,
      dueDate: input.checkOutDate,
      description: `Hotel Core room charge ${suffix}`,
      metadata,
    });

    const payment = await folioService.applyPaymentToFolio({
      tenantId: authContext.tenantId,
      folioId: folio.id,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'VND',
      paymentMethod: input.paymentMethod ?? 'cash',
      receivedAt: `${input.checkOutDate}T04:00:00.000Z`,
      idempotencyKey: `hotel-core-payment-${suffix}`,
      description: `Hotel Core payment ${suffix}`,
      metadata,
    });

    const closedFolio = await folioService.closeSettledFolio({
      tenantId: authContext.tenantId,
      folioId: folio.id,
      closedAt: `${input.checkOutDate}T05:00:00.000Z`,
    });

    const checkedOut = await frontOfficeService.checkOut({
      tenantId: authContext.tenantId,
      stayId: frontOffice.stay.id,
      checkedOutAt: `${input.checkOutDate}T06:00:00.000Z`,
    });

    revalidatePath(HOTEL_CORE_CHAIN_ROUTE);

    return {
      ok: true,
      value: {
        productKey: resolvedProduct.product.productKey,
        tenantId: authContext.tenantId,
        userId: authContext.userId,
        propertyId: foundation.property.id,
        roomId: foundation.room.id,
        guestId: reservationChain.guest.id,
        reservationId: reservationChain.reservation.id,
        reservationRoomId: reservationChain.reservedRoom.id,
        stayId: checkedOut.stay.id,
        stayStatus: checkedOut.stay.status,
        occupancyId: checkedOut.occupancy.id,
        occupancyStatus: checkedOut.occupancy.status,
        folioId: closedFolio.id,
        folioStatus: closedFolio.status,
        folioOutstandingAmountMinor: closedFolio.outstandingAmountMinor,
        folioPaidAmountMinor: closedFolio.paidAmountMinor,
        folioItemId: charge.item.id,
        financeInvoiceId: charge.financeLink.financeInvoiceId,
        financeAllocationId: payment.application.financeAllocationId,
        financeCashMovementId: payment.application.financeCashMovementId,
        financeAllocatedAmountMinor: payment.financeResult.allocatedAmountMinor,
      },
    };
  } catch (error) {
    return failure(
      'HOSPITALITY_HOTEL_CORE_CHAIN_FAILED',
      error instanceof Error ? error.message : 'Hospitality Hotel Core chain failed.'
    );
  } finally {
    await db.end();
  }
}

async function resolveHospitalityAuthContext(): Promise<
  HospitalityHotelCoreChainActionResult<HospitalityAuthContext>
> {
  const { getCurrentUser } = await import('./user-actions');
  const user = await getCurrentUser();

  if (!user) {
    return failure('HOSPITALITY_CHAIN_UNAUTHENTICATED', 'Authenticated user is required.');
  }
  if (!hasText(user.id)) {
    return failure('HOSPITALITY_CHAIN_USER_NOT_FOUND', 'Authenticated user id is required.');
  }
  if (!hasText(user.tenant_id)) {
    return failure('HOSPITALITY_CHAIN_TENANT_NOT_FOUND', 'Authenticated user tenant is required.');
  }

  return {
    ok: true,
    value: {
      userId: user.id,
      tenantId: user.tenant_id,
    },
  };
}

async function readTenantIdentity(db: Client, tenantId: string): Promise<TenantIdentity> {
  const result = await db.query<TenantProductRow & QueryResultRow>(
    `
      SELECT id, product_key
      FROM public.tenants
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [tenantId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('HOSPITALITY_CHAIN_TENANT_IDENTITY_NOT_FOUND');
  }
  return {
    id: row.id,
    product_key: row.product_key,
  };
}

async function bindAuthenticatedHospitalitySession(
  db: Client,
  authContext: HospitalityAuthContext
): Promise<void> {
  const claims = JSON.stringify({
    sub: authContext.userId,
    role: 'authenticated',
    app_metadata: {
      tenant_id: authContext.tenantId,
      role: 'admin',
    },
  });

  await db.query("SET ROLE authenticated");
  await db.query("SET row_security = on");
  await db.query(
    `
      SELECT
        set_config('request.jwt.claim.sub', $1, false),
        set_config('request.jwt.claim.role', 'authenticated', false),
        set_config('request.jwt.claims', $2, false),
        set_config('app.current_tenant_id', $3, false)
    `,
    [authContext.userId, claims, authContext.tenantId]
  );
}

async function bindAuthenticatedHospitalityTransaction(
  db: Client,
  authContext: HospitalityAuthContext
): Promise<void> {
  const claims = JSON.stringify({
    sub: authContext.userId,
    role: 'authenticated',
    app_metadata: {
      tenant_id: authContext.tenantId,
      role: 'admin',
    },
  });

  await db.query("SET LOCAL ROLE authenticated");
  await db.query("SET LOCAL row_security = on");
  await db.query(
    `
      SELECT
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', $2, true),
        set_config('app.current_tenant_id', $3, true)
    `,
    [authContext.userId, claims, authContext.tenantId]
  );
}

function createFinanceContract(): SemanticReceivableChargeService {
  const { url, adminKey } = requireSupabaseAdminEnv();
  const supabase = createSupabaseClient<Database>(url, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return new SemanticReceivableChargeService(
    new SupabaseReceivableChargeGateway(supabase, 'service_role')
  );
}

function validateInput(
  input: HospitalityHotelCoreChainActionInput
): HospitalityHotelCoreChainActionResult<undefined> {
  if (!hasText(input.marker)) {
    return failure('HOSPITALITY_CHAIN_MARKER_REQUIRED', 'Marker is required.');
  }
  if (!hasText(input.guestPartyId)) {
    return failure('HOSPITALITY_CHAIN_GUEST_PARTY_REQUIRED', 'Guest Party id is required.');
  }
  if (!isDate(input.checkInDate) || !isDate(input.checkOutDate)) {
    return failure('HOSPITALITY_CHAIN_DATE_INVALID', 'Check-in and check-out dates must be ISO dates.');
  }
  if (input.checkOutDate <= input.checkInDate) {
    return failure('HOSPITALITY_CHAIN_DATE_RANGE_INVALID', 'Check-out date must be after check-in date.');
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return failure('HOSPITALITY_CHAIN_AMOUNT_INVALID', 'Amount must be a positive integer minor-unit value.');
  }

  return { ok: true, value: undefined };
}

function getHospitalityDatabaseUrl(): string | undefined {
  return process.env.SUPABASE_DB_URL
    ?? process.env.SUPABASE_DATABASE_URL
    ?? process.env.DATABASE_URL;
}

function sslConfig(dbUrl: string): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function normalizeMarker(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 28);
  return normalized || 'hotel-core-proof';
}

function firstSqlStatement(sql: string): string {
  return sql.trimStart().split(/\s+/, 1)[0]?.toUpperCase() ?? '';
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function failure<TValue>(
  code: string,
  message: string
): HospitalityHotelCoreChainActionResult<TValue> {
  return {
    ok: false,
    error: { code, message },
  };
}
